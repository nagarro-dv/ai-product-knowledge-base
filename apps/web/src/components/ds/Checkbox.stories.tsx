import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckboxShowcase } from "./CheckboxShowcase";

const meta = {
  title: "Design System/Checkbox",
  component: CheckboxShowcase,
} satisfies Meta<typeof CheckboxShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
