import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/page-header";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { EXAMPLES } from "@/lib/examples";

export default function DemosIndex() {
  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <PageHeader eyebrow="Demos" title="Layout playground">
          A playground for the layout primitives. Pick an example to inspect how
          it's wired up.
        </PageHeader>

        <ul className="grid gap-3">
          {EXAMPLES.map((ex) => (
            <li key={ex.slug}>
              <Item
                render={<Link to={`/demos/${ex.slug}`} />}
                variant="outline"
                className="group flex-nowrap gap-4 bg-card p-4"
              >
                <ItemMedia className="size-10 rounded-md bg-muted text-muted-foreground group-hover:bg-background">
                  <ex.Icon className="size-5" />
                </ItemMedia>
                <ItemContent className="min-w-0 gap-0.5">
                  <ItemTitle>{ex.title}</ItemTitle>
                  <ItemDescription className="text-xs">
                    {ex.description}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </ItemActions>
              </Item>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
