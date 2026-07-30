import type { Meta, StoryObj } from "@storybook/react-vite";
import { TypographyShowcase } from "./TypographyShowcase";

const meta = {
  title: "Design System/Typography",
  component: TypographyShowcase,
} satisfies Meta<typeof TypographyShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
