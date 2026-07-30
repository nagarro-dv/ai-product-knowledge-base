import type { Meta, StoryObj } from "@storybook/react-vite";
import { WidgetShowcase } from "./WidgetShowcase";

const meta = {
  title: "Design System/Widget",
  component: WidgetShowcase,
} satisfies Meta<typeof WidgetShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
