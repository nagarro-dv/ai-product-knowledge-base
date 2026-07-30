import type { Meta, StoryObj } from "@storybook/react-vite";
import { CircularSliderShowcase } from "./CircularSliderShowcase";

const meta = {
  title: "Design System/Circular Slider",
  component: CircularSliderShowcase,
} satisfies Meta<typeof CircularSliderShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
