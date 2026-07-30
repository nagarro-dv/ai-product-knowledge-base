import type { Meta, StoryObj } from "@storybook/react-vite";
import { SuccessShowcase } from "./SuccessShowcase";

const meta = {
  title: "Design System/Success",
  component: SuccessShowcase,
} satisfies Meta<typeof SuccessShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
