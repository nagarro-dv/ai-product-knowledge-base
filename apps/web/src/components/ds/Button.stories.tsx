import type { Meta, StoryObj } from "@storybook/react-vite";
import { ButtonShowcase } from "./ButtonShowcase";

const meta = {
  title: "Design System/Button",
  component: ButtonShowcase,
} satisfies Meta<typeof ButtonShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
