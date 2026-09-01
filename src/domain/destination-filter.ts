import type { CatalogueDestination, DestinationCard, DestinationConstraintCategory, DestinationEvaluation, DestinationFilterConstraints } from '../../packages/contracts/src/destination';
import { AiDestinationAnnotationsSchema } from '../../packages/contracts/src/destination';

const normalize = (value: string) => value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
const matchesTerms = (terms: string[], tags: string[]) => terms.every((term) => tags.some((tag) => normalize(tag).includes(normalize(term)) || normalize(term).includes(normalize(tag))));

export function evaluateDestination(candidate: CatalogueDestination, constraints: DestinationFilterConstraints): DestinationEvaluation {
  const failed = new Set<DestinationConstraintCategory>();
  const reasons: string[] = [];
  if (!candidate.enabled) return { eligible: false, failedCategories: [], matchReasons: [] };
  if (constraints.currency && constraints.budgetMaximum !== null) {
    const estimate = candidate.estimate;
    if (estimate.currency !== constraints.currency || estimate.minimum === null || estimate.maximum === null || estimate.minimum > constraints.budgetMaximum || (constraints.budgetMinimum !== null && estimate.maximum < constraints.budgetMinimum)) failed.add('budget');
    else reasons.push(`Estimated from ${estimate.currency} ${estimate.minimum} within the group budget ceiling.`);
  }
  if (constraints.maxTravelMinutes !== null) {
    const routes = constraints.origins.map((origin) => candidate.travelTimes.find((route) => normalize(route.origin) === normalize(origin)));
    if (routes.length === 0 || routes.some((route) => !route || route.minutes === null || route.minutes > constraints.maxTravelMinutes!)) failed.add('travel_time');
    else reasons.push('Estimated travel time is within every submitted maximum.');
  }
  const tagChecks: [DestinationConstraintCategory, string[], string[]][] = [
    ['climate', constraints.climateTerms, candidate.climateTags], ['visa', constraints.visaTerms, candidate.visaTags],
    ['accessibility', constraints.accessibilityTerms, candidate.accessibilityTags], ['transport', constraints.transportTerms, candidate.transportTags],
    ['accommodation', constraints.accommodationTerms, candidate.accommodationTags],
  ];
  for (const [category, terms, tags] of tagChecks) {
    if (terms.length && !matchesTerms(terms, tags)) failed.add(category);
    else if (terms.length) reasons.push(`${category[0].toUpperCase()}${category.slice(1).replace('_', ' ')} requirements have catalogue support.`);
  }
  const searchable = [candidate.name, candidate.country, ...candidate.interests, ...candidate.climateTags, ...candidate.transportTags, ...candidate.accommodationTags].map(normalize).join(' ');
  if (constraints.dealbreakerTerms.some((term) => searchable.includes(normalize(term)))) failed.add('dealbreaker');
  if (candidate.interests.length) reasons.push(`Interests include ${candidate.interests.slice(0, 3).join(', ')}.`);
  return { eligible: failed.size === 0, failedCategories: [...failed], matchReasons: reasons.slice(0, 8) };
}

export function filterDestinations(candidates: CatalogueDestination[], constraints: DestinationFilterConstraints) {
  return candidates.map((candidate) => ({ candidate, evaluation: evaluateDestination(candidate, constraints) })).filter((item) => item.evaluation.eligible);
}

export function minimumRevisionCategories(evaluations: DestinationEvaluation[]): DestinationConstraintCategory[] {
  const possible = evaluations.filter((item) => item.failedCategories.length > 0).sort((left, right) => left.failedCategories.length - right.failedCategories.length);
  return possible[0] ? [...possible[0].failedCategories] : [];
}

export function applyDestinationAnnotations(cards: DestinationCard[], candidate: unknown): DestinationCard[] {
  const parsed = AiDestinationAnnotationsSchema.safeParse(candidate);
  if (!parsed.success) return cards;
  const eligible = new Map(cards.filter((card) => card.eligible).map((card) => [card.destinationId, card]));
  const seen = new Set<string>();
  for (const annotation of parsed.data.destinations) {
    const card = eligible.get(annotation.destinationId);
    if (!card || seen.has(annotation.destinationId) || annotation.reasonOrder.length !== card.matchReasons.length || new Set(annotation.reasonOrder).size !== annotation.reasonOrder.length || annotation.reasonOrder.some((index) => index >= card.matchReasons.length)) return cards;
    seen.add(annotation.destinationId);
  }
  const orders = new Map(parsed.data.destinations.map((item) => [item.destinationId, item.reasonOrder]));
  return cards.map((card) => {
    const order = orders.get(card.destinationId);
    return order ? { ...card, matchReasons: order.map((index) => card.matchReasons[index]) } : card;
  });
}
