// These are shortcuts to native selections, never to arbitrary request parameters.
const speedRanks = ['off', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const speedRank = id => speedRanks.indexOf(String(id ?? '').toLowerCase());
const ownSpeedEntry = (entries, id) => entries && Object.hasOwn(entries, id) ? entries[id] : undefined;

export function resolveSpeedActions(projected, config, hasPriority) {
  const {row, rows, tiers, activeId} = projected;
  if (!row) return [];
  const provider = ownSpeedEntry(config?.providers, row.provider);
  const profile = ownSpeedEntry(provider?.models, row.model);
  const lighterEffort = profile?.lighterEffort ?? provider?.lighterEffort ?? config?.showLighterEffort ?? true;
  let target;
  if (typeof lighterEffort === 'string') {
    target = tiers.find(tier => tier.id === lighterEffort && tier.available !== false);
  } else if (lighterEffort && !hasPriority && tiers.length > 1) {
    const currentRank = speedRank(activeId);
    // Prefer a lightweight thinking tier over disabling it. Unknown tiers are not ranked.
    const lighter = ['low', 'minimal', 'off', 'none'];
    target = lighter.map(id => tiers.find(tier => tier.id.toLowerCase() === id && tier.available !== false))
      .find(tier => tier && (activeId === undefined || (currentRank !== -1 && speedRank(tier.id) < currentRank)));
  }
  const actions = [];
  const activeRank = speedRank(activeId), targetRank = speedRank(target?.id);
  if (target && target.id !== activeId && (activeRank < 0 || targetRank < 0 || targetRank < activeRank)) {
    actions.push({id: JSON.stringify([row.id,'effort',target.id]), kind:'effort', value:target.id, name:target.label});
  }
  const alternateModel = profile?.alternateModel;
  if (typeof alternateModel === 'string' && alternateModel !== row.model) {
    const alt = rows.find(other => other.provider === row.provider && other.model === alternateModel);
    if (alt) actions.push({id:JSON.stringify([row.id,'model',alt.id]), kind:'model', value:alt.id, name:alt.label});
  }
  return actions;
}

export function validateSpeedConfig(input) {
  function object(value, path) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${path} must be an object`);
    return Object.entries(value);
  }
  function fields(value, allowed, path) {
    for (const [key] of object(value, path)) if (!allowed.includes(key)) throw new Error(`${path}.${key} is not supported`);
  }
  function identifier(value, path) {
    if (typeof value !== 'string' || !value.trim() || value.length > 512) throw new Error(`${path} must be a non-empty ID`);
  }
  function effort(value, path) {
    if (typeof value !== 'boolean') identifier(value, path);
  }
  fields(input, ['showLighterEffort','providers'], 'speed profiles');
  if (input.showLighterEffort !== undefined && typeof input.showLighterEffort !== 'boolean') throw new Error('showLighterEffort must be a boolean');
  for (const [provider, route] of object(input.providers === undefined ? {} : input.providers, 'providers')) {
    identifier(provider,'provider ID');
    const path = `providers.${provider}`;
    fields(route,['lighterEffort','models'],path);
    if (route.lighterEffort !== undefined) effort(route.lighterEffort,`${path}.lighterEffort`);
    for (const [id, profile] of object(route.models === undefined ? {} : route.models,`${path}.models`)) {
      identifier(id, 'model ID');
      const key = `${path}.models.${id}`;
      fields(profile,['lighterEffort','alternateModel'],key);
      if (profile.lighterEffort !== undefined) effort(profile.lighterEffort,`${key}.lighterEffort`);
      if (profile.alternateModel !== undefined) identifier(profile.alternateModel,`${key}.alternateModel`);
    }
  }
  return input;
}
