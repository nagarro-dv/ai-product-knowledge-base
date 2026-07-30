import type { Meta, StoryObj } from "@storybook/react-vite";
import { BadgeShowcase } from "./BadgeShowcase";

const meta = {
  title: "Design System/Badge",
  component: BadgeShowcase,
} satisfies Meta<typeof BadgeShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
