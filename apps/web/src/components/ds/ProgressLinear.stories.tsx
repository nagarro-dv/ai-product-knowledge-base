import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProgressLinearShowcase } from "./ProgressLinearShowcase";

const meta = {
  title: "Design System/Progress Linear",
  component: ProgressLinearShowcase,
} satisfies Meta<typeof ProgressLinearShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
