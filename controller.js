// All route keys are opaque; provider/model IDs may contain slashes.
export function project(snapshot) {
  const current = snapshot.current;
  const rows = snapshot.groups.flatMap(group => group.models.map(model => ({
    id: JSON.stringify([group.id, model.id]), label: model.name, group: group.name,
    provider: group.id, model: model.id, reasoning: model.reasoning,
  })));
  const row = rows.find(row => row.provider === current?.provider && row.model === current?.model);
  const defaultId = row?.reasoning?.defaultEffort;
  const tiers = (row?.reasoning?.efforts ?? []).map(({id,name,description}) => ({
    id, label: name, description, available: true, isDefault: id === defaultId,
  }));
  return { rows, row, models: rows.map(({ id, label, group, provider }) => ({id,label,group,providerId:provider})),
    modelId: row?.id, modelLabel: row?.label, tiers, defaultId,
    activeId: row ? (current.reasoningEffort ?? defaultId) : undefined };
}

// Revalidate against the latest catalog when the pointer/key is released.
export function selectionFor(snapshot, action, id, displayedModel) {
  if (snapshot.pending || snapshot.status === 'loading' || snapshot.status === 'selecting') return;
  const { rows, row, tiers, defaultId } = project(snapshot);
  const target = action === 'model' ? rows.find(x => x.id === id) : row;
  if (!target || (action !== 'model' && target.id !== displayedModel)) return;
  let effort;
  if (action === 'effort') {
    if (!tiers.some(x => x.id === id)) return;
    effort = id;
  } else if (action === 'reset') {
    if (!target.reasoning) return;
    effort = defaultId;
  } else if (action === 'model') {
    if (row?.id === target.id) return;
    effort = target.reasoning?.defaultEffort;
  } else return;
  return {provider: target.provider, model: target.model,
    ...(effort === undefined ? {} : {reasoningEffort: effort})};
}
