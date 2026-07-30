import type { Meta, StoryObj } from "@storybook/react-vite";
import { SliderShowcase } from "./SliderShowcase";

const meta = {
  title: "Design System/Slider",
  component: SliderShowcase,
} satisfies Meta<typeof SliderShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
