import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircularConfidenceSelectorShowcase } from "./CircularConfidenceSelectorShowcase";

const meta = {
  title: "Design System/Circular Confidence Selector",
  component: CircularConfidenceSelectorShowcase,
} satisfies Meta<typeof CircularConfidenceSelectorShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
