export type Project = {
  id: string;
  title: string;
  tag: string;
  description: string;
  color: string;
  sort_order: number;
  rating: number | null;
  website_link: string | null;
  image_url: string | null;
  created_at?: string;
};

export type Testimonial = {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
  created_at?: string | null;
};

export type PricingPlan = {
  id: string;
  name: string;
  description: string;
  highlight: boolean;
  sort_order: number;
  price_usd_cents: number;
  active: boolean;
};

export type PricingFeature = {
  id: string;
  plan_id: string;
  feature: string;
  sort_order: number;
};

export type Submission = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  service: string;
  message: string;
  status: "unread" | "read";
  created_at: string;
};

export type Settings = Record<string, string>;

export type AdminTab = "overview" | "submissions" | "projects" | "testimonials" | "pricing" | "notifications" | "site";

export const ADMIN_TABS: AdminTab[] = ["overview", "submissions", "projects", "testimonials", "pricing", "notifications", "site"];

export type TableName = "projects" | "testimonials" | "pricing" | "submissions" | "settings";

export type AdminData = {
  projects: Project[];
  testimonials: Testimonial[];
  plans: PricingPlan[];
  features: PricingFeature[];
  submissions: Submission[];
  settings: Settings;
};

export type PanelProps = {
  data: AdminData;
  loading: boolean;
  reload: (table: TableName) => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<AdminData>>;
  goTo: (tab: AdminTab, intent?: string) => void;
  /** One-shot instruction from another panel, e.g. "create" or "open:<id>" */
  intent: string | null;
  clearIntent: () => void;
};
