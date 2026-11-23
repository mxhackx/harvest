import { templateResponse } from "@/lib/templates";

export function GET() {
  return templateResponse("leads-minimal.csv");
}
