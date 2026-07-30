import type { Meta, StoryObj } from "@storybook/react-vite";
import { FlexibleRangeShowcase } from "./FlexibleRangeShowcase";

const meta = {
  title: "Design System/Flexible Range",
  component: FlexibleRangeShowcase,
} satisfies Meta<typeof FlexibleRangeShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
