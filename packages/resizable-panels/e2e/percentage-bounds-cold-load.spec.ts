import { expect, test } from "@playwright/test";

type ColdLoadSample = {
  ancestorWidth: number;
  cardWidth: number;
  elapsed: number;
  groupWidth: number;
  panels: Array<{
    basis: string;
    contentTransition: string;
    contentWidth: number;
    contentWidthStyle: string;
    kind: string | null;
    transition: string;
    width: number;
    widthStyle: string;
  }>;
  source: "mutation" | "frame";
};

declare global {
  interface Window {
    __percentageBoundsColdLoad?: {
      firstFoundAt?: number;
      samples: ColdLoadSample[];
      startedAt: number;
    };
  }
}

test("the real percentage-bounds card is stable across repeated cold loads", async ({
  page,
}) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });

  await page.addInitScript(() => {
    const timeline: NonNullable<Window["__percentageBoundsColdLoad"]> = {
      samples: [] as ColdLoadSample[],
      startedAt: performance.now(),
    };
    window.__percentageBoundsColdLoad = timeline;

    const sample = (source: ColdLoadSample["source"]) => {
      const card = document.querySelector<HTMLElement>(
        '[data-demo="percentage-bounds"]',
      );
      const frame = card?.querySelector<HTMLElement>(
        "[data-resizable-panels-demo-frame]",
      );
      const group = frame?.querySelector<HTMLElement>(
        "[data-resizable-panels-panel-group]",
      );
      if (!card || !frame || !group) return;

      const panels = Array.from(group.children).filter(
        (node): node is HTMLElement =>
          node instanceof HTMLElement &&
          node.hasAttribute("data-resizable-panels-panel"),
      );
      if (panels.length !== 3) return;
      timeline.firstFoundAt ??= performance.now();
      timeline.samples.push({
        ancestorWidth:
          card.parentElement?.getBoundingClientRect().width ?? Number.NaN,
        cardWidth: card.getBoundingClientRect().width,
        elapsed: performance.now() - timeline.startedAt,
        groupWidth: group.getBoundingClientRect().width,
        panels: panels.map((panel) => {
          const computed = getComputedStyle(panel);
          const content = panel.querySelector<HTMLElement>(
            "[data-resizable-panels-panel-content]",
          );
          const contentComputed = content ? getComputedStyle(content) : null;
          return {
            basis: panel.style.flexBasis,
            contentTransition: contentComputed?.transition ?? "",
            contentWidth:
              content?.getBoundingClientRect().width ??
              panel.getBoundingClientRect().width,
            contentWidthStyle: content?.style.width ?? panel.style.width,
            kind: panel.getAttribute("data-kind"),
            transition: computed.transition,
            width: panel.getBoundingClientRect().width,
            widthStyle: panel.style.width,
          };
        }),
        source,
      });
    };

    new MutationObserver(() => sample("mutation")).observe(document, {
      attributeFilter: ["style"],
      attributes: true,
      childList: true,
      subtree: true,
    });
    const sampleFrame = () => {
      sample("frame");
      const firstFoundAt = timeline.firstFoundAt;
      if (
        firstFoundAt === undefined ||
        performance.now() - firstFoundAt < 500
      ) {
        requestAnimationFrame(sampleFrame);
      }
    };
    requestAnimationFrame(sampleFrame);
  });

  for (const viewportWidth of [375, 800, 1280]) {
    await page.setViewportSize({ width: viewportWidth, height: 900 });
    for (let attempt = 0; attempt < 2; attempt++) {
      await page.goto(
        `/mini-demos?cold=${viewportWidth}-${attempt}-${Date.now()}#percentage-bounds`,
        { waitUntil: "load" },
      );
      await page.waitForTimeout(550);

      const samples = await page.evaluate(
        () => window.__percentageBoundsColdLoad?.samples ?? [],
      );
      const frames = samples.filter(
        (sample) => sample.source === "frame" && sample.groupWidth > 1,
      );
      expect(frames.length).toBeGreaterThan(4);
      const first = frames[0];
      const last = frames.at(-1);
      if (!first || !last) throw new Error("Expected visible frame samples");

      expect(first.panels.map((panel) => panel.kind)).toEqual([
        "docked",
        "peer",
        "docked",
      ]);
      expect(
        first.panels.map((panel) => panel.width / first.groupWidth),
      ).toEqual([
        expect.closeTo(0.33, 2),
        expect.closeTo(0.34, 2),
        expect.closeTo(0.33, 2),
      ]);

      for (const frameSample of frames) {
        expect(frameSample.ancestorWidth).toBeCloseTo(first.ancestorWidth, 0);
        expect(frameSample.cardWidth).toBeCloseTo(first.cardWidth, 0);
        expect(frameSample.groupWidth).toBeCloseTo(first.groupWidth, 0);
        for (let index = 0; index < frameSample.panels.length; index++) {
          const panel = frameSample.panels[index];
          const firstPanel = first.panels[index];
          if (!panel || !firstPanel) throw new Error("Expected three panels");
          expect(panel.width).toBeCloseTo(firstPanel.width, 0);
          expect(panel.contentWidth).toBeCloseTo(panel.width, 0);
        }
      }

      expect(last.panels.map((panel) => panel.width)).toEqual(
        first.panels.map((panel) => expect.closeTo(panel.width, 0)),
      );
    }
  }
});
