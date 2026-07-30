import type { Meta, StoryObj } from "@storybook/react-vite";
import { RichCheckboxGroupShowcase } from "./RichCheckboxGroupShowcase";

const meta = {
  title: "Design System/Rich Checkbox Group",
  component: RichCheckboxGroupShowcase,
} satisfies Meta<typeof RichCheckboxGroupShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
