import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowUp, ArrowDown, X, LayoutGrid, Plus, GripVertical, MoveHorizontal, ArrowRight, Info } from 'lucide-react';
import { LEAD_SOURCES } from './LeadRoutingDialog';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Team {
  id: string;
  name: string;
  color: string;
  emoji: string | null;
}

interface SourceRule {
  id: string;
  team_id: string;
  source: string;
  allowed: boolean;
  priority: number;
}

interface Props {
  teams: Team[];
  rules: SourceRule[];
  canEdit: boolean;
  routingEnabled: boolean;
  /** Toggle whether a team is in the running for this source. */
  onSetAllowed: (teamId: string, source: string, allowed: boolean) => void;
  /** Change a team's priority for this source (lower = picked first). */
  onSetPriority: (teamId: string, source: string, priority: number) => void;
}

interface ChipProps {
  team: Team;
  index: number;
  total: number;
  canEdit: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}

const TeamChip = ({ team, index, total, canEdit, onMoveUp, onMoveDown, onRemove }: ChipProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: team.id,
    disabled: !canEdit,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    backgroundColor: team.color,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 'auto',
    boxShadow: isDragging ? '0 8px 24px rgba(0,0,0,0.25)' : undefined,
  };

  const pickLabel =
    index === 0 ? '1st — tried first'
    : index === 1 ? '2nd — backup'
    : index === 2 ? '3rd — backup'
    : `${index + 1}th — backup`;
  const shortPick =
    index === 0 ? '1st pick'
    : index === 1 ? '2nd (backup)'
    : index === 2 ? '3rd (backup)'
    : `${index + 1}th (backup)`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`inline-flex items-center gap-1.5 pl-1 pr-1 py-1 text-xs font-bold text-white border-2 border-foreground rounded shadow-sm ${
        isDragging ? 'cursor-grabbing ring-4 ring-foreground/30' : ''
      }`}
      title={pickLabel}
    >
      {canEdit && (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 rounded cursor-grab active:cursor-grabbing hover:bg-white/30 touch-none"
          title="Drag to reorder"
          aria-label={`Drag ${team.name} to reorder`}
        >
          <GripVertical className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
      )}
      <span className="bg-white text-foreground px-1.5 py-0.5 rounded-sm text-[10px] font-extrabold tabular-nums uppercase tracking-wide">
        {shortPick}
      </span>
      <span className="pr-1">{team.emoji} {team.name}</span>
      {canEdit && (
        <div className="ml-0.5 flex items-center gap-0.5 bg-white/15 rounded px-0.5">
          <button
            type="button"
            onClick={onMoveUp}
            disabled={index === 0}
            className="p-1 rounded hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move left (try this team first)"
            aria-label="Move team up"
          >
            <ArrowUp className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={onMoveDown}
            disabled={index === total - 1}
            className="p-1 rounded hover:bg-white/30 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Move right (try this team later)"
            aria-label="Move team down"
          >
            <ArrowDown className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded hover:bg-white/30"
            title="Remove team from this source"
            aria-label="Remove team"
          >
            <X className="h-3.5 w-3.5" strokeWidth={3} />
          </button>
        </div>
      )}
    </div>
  );
};

interface RowProps {
  source: typeof LEAD_SOURCES[number];
  ordered: { team: Team }[];
  unallowed: Team[];
  canEdit: boolean;
  onReorder: (newOrderIds: string[]) => void;
  onMove: (teamId: string, dir: -1 | 1) => void;
  onRemove: (teamId: string) => void;
  onAdd: (teamId: string) => void;
}

const SourceRow = ({ source, ordered, unallowed, canEdit, onReorder, onMove, onRemove, onAdd }: RowProps) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = ordered.map(o => o.team.id);

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(ids, oldIndex, newIndex));
  };

  return (
    <div className="px-4 py-3 flex flex-wrap items-center gap-3 hover:bg-muted/30">
      <div className="flex items-center gap-2 min-w-[180px]">
        <span className="text-base">{source.icon}</span>
        <span className="font-semibold text-sm">{source.label}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 flex-1">
        {ordered.length === 0 && (
          <span className="text-xs text-muted-foreground italic">
            No team — falls back to the live global flow.
          </span>
        )}
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
            <div className="flex flex-wrap items-center gap-2">
              {ordered.map(({ team }, i) => (
                <React.Fragment key={team.id}>
                  {i > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground select-none">
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={3} />
                      then
                    </span>
                  )}
                  <TeamChip
                    team={team}
                    index={i}
                    total={ordered.length}
                    canEdit={canEdit}
                    onMoveUp={() => onMove(team.id, -1)}
                    onMoveDown={() => onMove(team.id, 1)}
                    onRemove={() => onRemove(team.id)}
                  />
                </React.Fragment>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>


      {canEdit && unallowed.length > 0 && (
        <Select onValueChange={(v) => onAdd(v)} value="">
          <SelectTrigger className="h-9 w-[180px] text-xs shrink-0 border-2 border-dashed border-foreground/40 bg-background hover:bg-muted font-semibold">
            <SelectValue placeholder={
              <span className="inline-flex items-center gap-1.5 text-foreground">
                <Plus className="h-3.5 w-3.5" /> Add a team here
              </span>
            } />
          </SelectTrigger>
          <SelectContent>
            {unallowed.map(t => (
              <SelectItem key={t.id} value={t.id} className="text-xs">
                {t.emoji} {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export const SourceRulesMatrix = ({ teams, rules, canEdit, routingEnabled, onSetAllowed, onSetPriority }: Props) => {
  if (!teams.length) return null;

  const orderedTeams = (source: string) => {
    const allowed = rules
      .filter(r => r.source === source && r.allowed)
      .map(r => ({ team: teams.find(t => t.id === r.team_id), priority: r.priority ?? 0 }))
      .filter((x): x is { team: Team; priority: number } => Boolean(x.team));
    return allowed.sort((a, b) => a.priority - b.priority || a.team.name.localeCompare(b.team.name));
  };

  const unallowedTeams = (source: string) => {
    const allowedIds = new Set(rules.filter(r => r.source === source && r.allowed).map(r => r.team_id));
    return teams.filter(t => !allowedIds.has(t.id));
  };

  const applyOrder = (source: string, orderIds: string[]) => {
    orderIds.forEach((id, i) => onSetPriority(id, source, i + 1));
  };

  const move = (source: string, teamId: string, dir: -1 | 1) => {
    const ids = orderedTeams(source).map(o => o.team.id);
    const idx = ids.indexOf(teamId);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= ids.length) return;
    applyOrder(source, arrayMove(ids, idx, swap));
  };

  const addTeam = (source: string, teamId: string) => {
    const nextPriority = orderedTeams(source).length + 1;
    onSetAllowed(teamId, source, true);
    onSetPriority(teamId, source, nextPriority);
  };

  return (
    <div className="border border-border bg-card rounded-md overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border bg-muted/40 flex items-center gap-2 flex-wrap">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">Which team gets each source first</span>
        {!routingEnabled && (
          <span className="ml-1 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide rounded-md border border-border bg-background text-muted-foreground">
            Preview · Master OFF
          </span>
        )}
      </div>

      {/* Plain-English explainer of how the order works */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border space-y-2">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">How the order works:</strong> for each source (Facebook, Google, etc.), the lead is offered to the
            <strong className="text-foreground"> 1st pick team first</strong>. If no one on that team can take it (everyone offline or paused),
            it falls through to the <strong className="text-foreground">2nd pick</strong>, then the <strong className="text-foreground">3rd pick</strong>, and so on.
            <span className="block mt-1">
              Inside a team, the lead is shared between active agents using their slice %.
            </span>
          </p>
        </div>
        {/* Visual example */}
        <div className="flex items-center gap-2 flex-wrap pl-6 text-[11px] font-medium">
          <span className="text-muted-foreground uppercase tracking-wide">Example:</span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background border border-border text-foreground">
            <span className="bg-foreground text-background px-1.5 py-0.5 rounded text-[10px]">1st pick</span>
            tried first
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background border border-border text-muted-foreground">
            <span className="bg-muted-foreground text-background px-1.5 py-0.5 rounded text-[10px]">2nd (backup)</span>
            only if 1st can't take it
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background border border-border text-muted-foreground">
            <span className="bg-muted-foreground/70 text-background px-1.5 py-0.5 rounded text-[10px]">3rd (backup)</span>
            last resort
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground pl-6 flex items-center gap-1.5">
          <MoveHorizontal className="h-3.5 w-3.5" />
          Drag chips left/right (or use the arrows) to change the order. Leftmost = tried first.
        </p>
      </div>



      <div className="divide-y-2 divide-foreground/10">
        {LEAD_SOURCES.map(s => (
          <SourceRow
            key={s.value}
            source={s}
            ordered={orderedTeams(s.value)}
            unallowed={unallowedTeams(s.value)}
            canEdit={canEdit}
            onReorder={(ids) => applyOrder(s.value, ids)}
            onMove={(teamId, dir) => move(s.value, teamId, dir)}
            onRemove={(teamId) => onSetAllowed(teamId, s.value, false)}
            onAdd={(teamId) => addTeam(s.value, teamId)}
          />
        ))}
      </div>
    </div>
  );
};
