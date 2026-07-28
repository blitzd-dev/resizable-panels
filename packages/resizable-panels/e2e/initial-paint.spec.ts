import { expect, test } from "@playwright/test";

type FrameSample = {
  elapsed: number;
  nested: LayoutSample | null;
  outer: LayoutSample | null;
};

type LayoutSample = {
  contents: number[];
  group: number;
  panels: number[];
  styles: Array<{ basis: string; width: string }>;
};

test("zero-first nested groups fill on their first non-zero presented frame", async ({
  page,
}) => {
  await page.setViewportSize({ width: 676, height: 800 });
  await page.addInitScript(() => {
    const target = window as typeof window & {
      __initialPaintFrames?: FrameSample[];
    };
    target.__initialPaintFrames = [];
    const started = performance.now();

    const read = (testId: string): LayoutSample | null => {
      const group = document.querySelector<HTMLElement>(
        `[data-testid="${testId}"]`,
      );
      if (!group) return null;
      const panels = Array.from(group.children).filter(
        (node): node is HTMLElement =>
          node instanceof HTMLElement &&
          node.hasAttribute("data-resizable-panels-panel"),
      );
      return {
        contents: panels.map((panel) => {
          const content = panel.querySelector<HTMLElement>(
            "[data-resizable-panels-panel-content]",
          );
          return (content ?? panel).getBoundingClientRect().width;
        }),
        group: group.getBoundingClientRect().width,
        panels: panels.map((panel) => panel.getBoundingClientRect().width),
        styles: panels.map((panel) => ({
          basis: panel.style.flexBasis,
          width: panel.style.width,
        })),
      };
    };

    const sample = (time: number) => {
      target.__initialPaintFrames?.push({
        elapsed: time - started,
        outer: read("initial-outer"),
        nested: read("initial-nested"),
      });
      if (time - started < 600) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.goto("/test/initial-paint");
  await page.waitForTimeout(650);
  const frames = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __initialPaintFrames?: FrameSample[];
        }
      ).__initialPaintFrames ?? [],
  );

  const visible = frames.filter(
    (sample) =>
      (sample.outer?.group ?? 0) > 1 && (sample.nested?.group ?? 0) > 1,
  );
  expect(visible.length).toBeGreaterThan(2);
  const first = visible[0];
  const settled = visible.at(-1);
  if (!first?.outer || !first.nested || !settled?.outer || !settled.nested) {
    throw new Error("Expected visible outer and nested layout samples");
  }

  for (const [label, layout] of [
    ["outer", first.outer],
    ["nested", first.nested],
  ] as const) {
    expect(
      Math.abs(
        layout.group - layout.panels.reduce((sum, width) => sum + width, 0),
      ),
      `${label} group did not fill on its first presented frame: ${JSON.stringify(
        first,
      )}`,
    ).toBeLessThanOrEqual(1);
  }

  expect(first.outer.panels[1]).toBeCloseTo(settled.outer.panels[1], 0);
  expect(first.nested.group).toBeCloseTo(settled.nested.group, 0);
  expect(first.nested.panels).toHaveLength(settled.nested.panels.length);
  for (let index = 0; index < first.nested.panels.length; index++) {
    expect(first.nested.panels[index]).toBeCloseTo(
      settled.nested.panels[index],
      0,
    );
    expect(first.nested.contents[index]).toBeCloseTo(
      first.nested.panels[index],
      0,
    );
  }
  expect(first.nested.panels[0] / first.nested.group).toBeCloseTo(0.33, 3);
  expect(first.nested.panels[2] / first.nested.group).toBeCloseTo(0.33, 3);
});

test("percentage defaults paint at 33% and stay live across viewport resizing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 676, height: 800 });
  await page.goto("/test/initial-paint");

  const group = page.getByTestId("initial-nested");
  const panels = group.locator(":scope > [data-resizable-panels-panel]");
  const geometry = async () => {
    const groupWidth = await group.evaluate(
      (node) => node.getBoundingClientRect().width,
    );
    const widths = await panels.evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLElement).getBoundingClientRect().width),
    );
    return { groupWidth, widths };
  };
  const roundedRatios = async () => {
    const { groupWidth, widths } = await geometry();
    return widths.map((width) => Number((width / groupWidth).toFixed(2)));
  };

  await expect.poll(roundedRatios).toEqual([0.33, 0.34, 0.33]);

  // String defaults are live until interaction (R-05): the declarations
  // remain live CSS percentages against every container size — there is no
  // bootstrap window after which they freeze to pixels.
  await page.setViewportSize({ width: 300, height: 800 });
  await expect.poll(roundedRatios).toEqual([0.33, 0.34, 0.33]);

  await page.setViewportSize({ width: 2500, height: 800 });
  await expect.poll(roundedRatios).toEqual([0.33, 0.34, 0.33]);

  // Deliberate mid-timeline pause, not synchronization: the layout is
  // already settled. This gives a reintroduced commit-on-idle timer (the
  // deleted 150ms bootstrap) time to fire so the next resize would catch
  // the defaults frozen at 2500-viewport pixels.
  await page.waitForTimeout(400);
  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(roundedRatios).toEqual([0.33, 0.34, 0.33]);
});
