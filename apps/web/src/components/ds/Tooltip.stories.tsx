import type { Meta, StoryObj } from "@storybook/react-vite";
import { TooltipShowcase } from "./TooltipShowcase";

const meta = {
  title: "Design System/Tooltip",
  component: TooltipShowcase,
} satisfies Meta<typeof TooltipShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
