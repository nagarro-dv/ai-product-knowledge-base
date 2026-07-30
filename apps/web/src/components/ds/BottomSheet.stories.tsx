import type { Meta, StoryObj } from "@storybook/react-vite";
import { BottomSheetShowcase } from "./BottomSheetShowcase";

const meta = {
  title: "Design System/Bottom Sheet",
  component: BottomSheetShowcase,
} satisfies Meta<typeof BottomSheetShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
