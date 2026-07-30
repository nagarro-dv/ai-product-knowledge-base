import type { Meta, StoryObj } from "@storybook/react-vite";
import { CreditScoreShowcase } from "./CreditScoreShowcase";

const meta = {
  title: "Design System/Credit Score",
  component: CreditScoreShowcase,
} satisfies Meta<typeof CreditScoreShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Showcase: Story = {};
