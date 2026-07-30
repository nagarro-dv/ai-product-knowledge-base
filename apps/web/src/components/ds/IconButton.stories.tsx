import type { Meta, StoryObj } from "@storybook/react-vite";
import { IconButtonShowcase } from "./IconButtonShowcase";

const meta = {
  title: "Design System/Icon Button",
  component: IconButtonShowcase,
} satisfies Meta<typeof IconButtonShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
