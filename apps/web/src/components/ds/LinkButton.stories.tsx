import type { Meta, StoryObj } from "@storybook/react-vite";
import { LinkButtonShowcase } from "./LinkButtonShowcase";

const meta = {
  title: "Design System/Link Button",
  component: LinkButtonShowcase,
} satisfies Meta<typeof LinkButtonShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
