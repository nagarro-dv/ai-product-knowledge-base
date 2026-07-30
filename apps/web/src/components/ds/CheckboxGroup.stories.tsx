import type { Meta, StoryObj } from "@storybook/react-vite";
import { CheckboxGroupShowcase } from "./CheckboxGroupShowcase";

const meta = {
  title: "Design System/Checkbox Group",
  component: CheckboxGroupShowcase,
} satisfies Meta<typeof CheckboxGroupShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
