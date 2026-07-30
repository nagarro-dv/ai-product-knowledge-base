import type { Meta, StoryObj } from "@storybook/react-vite";
import { AccordionShowcase } from "./AccordionShowcase";

const meta = {
  title: "Design System/Accordion",
  component: AccordionShowcase,
} satisfies Meta<typeof AccordionShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
