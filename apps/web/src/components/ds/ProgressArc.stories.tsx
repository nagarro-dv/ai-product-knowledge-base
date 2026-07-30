import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProgressArcShowcase } from "./ProgressArcShowcase";

const meta = {
  title: "Design System/Progress Arc",
  component: ProgressArcShowcase,
} satisfies Meta<typeof ProgressArcShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
