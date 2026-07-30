import type { Meta, StoryObj } from "@storybook/react-vite";
import { SpinnerShowcase } from "./SpinnerShowcase";

const meta = {
  title: "Design System/Spinner",
  component: SpinnerShowcase,
} satisfies Meta<typeof SpinnerShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
