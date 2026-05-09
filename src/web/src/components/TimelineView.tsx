import { type TaskWithPriority } from "../api/tasks.ts";
import TaskCard from "./TaskCard.tsx";

interface Group {
  label: string;
  sublabel?: string;
  tasks: TaskWithPriority[];
}

interface Props {
  groups: Group[];
}

export default function TimelineView({ groups }: Props) {
  const nonEmpty = groups.filter((g) => g.tasks.length > 0);

  if (nonEmpty.length === 0) {
    return (
      <div className="text-center py-16 text-stone-400">
        <p className="font-medium">Nenhuma tarefa neste período</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {nonEmpty.map((group) => (
        <section key={group.label}>
          <div className="flex items-baseline gap-2 mb-3">
            <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
              {group.label}
            </h2>
            {group.sublabel && (
              <span className="text-xs text-stone-400">{group.sublabel}</span>
            )}
            <span className="text-xs text-stone-400 ml-auto">
              {group.tasks.length} tarefa{group.tasks.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-3">
            {group.tasks.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
