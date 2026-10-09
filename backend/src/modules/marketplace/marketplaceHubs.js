export function getHubSlugForBusinessCategory(businessCategory) {
  if (!businessCategory) return "retail";
  const b = String(businessCategory).toLowerCase().trim();
  switch (b) {
    case "retail":
      return "retail";
    case "rental":
    case "rentals":
      return "rentals";
    case "service":
    case "services":
      return "services";
    case "restaurant":
    case "food":
      return "food";
    default:
      return "retail";
  }
}

export function isBusinessEligibleForHub(businessCategory, hubSlug) {
  if (!businessCategory || !hubSlug) return false;
  const b = String(businessCategory).toLowerCase().trim();
  const h = String(hubSlug).toLowerCase().trim();

  if (b === h) return true;
  if (b === "retail" && h === "retail") return true;
  if ((b === "rental" || b === "rentals") && (h === "rentals" || h === "rental")) return true;
  if ((b === "service" || b === "services") && (h === "services" || h === "service")) return true;
  if ((b === "restaurant" || b === "food") && (h === "food" || h === "restaurant")) return true;
  if (b === "other" && h === "retail") return true;

  return false;
}
