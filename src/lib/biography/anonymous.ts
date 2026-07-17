import type { Basics, Biography } from "@/lib/types";

const ANONYMOUS_BASICS: Basics = {
  name: "John Doe",
  email: "john.doe@example.com",
  image: "",
  phone: "+1 555 0100",
  location: {
    city: "Anytown",
    region: "State",
    country: "United States",
    country_code: "US",
  },
  profiles: [
    {
      network: "LinkedIn",
      username: "johndoe",
      url: "https://linkedin.com/in/johndoe",
    },
  ],
};

export function applyAnonymousMode(biography: Biography): Biography {
  return {
    ...biography,
    basics: { ...ANONYMOUS_BASICS },
  };
}
