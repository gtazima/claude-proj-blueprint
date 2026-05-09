import clsx from "clsx";

interface Props {
  score: number;
}

function label(score: number): { text: string; cls: string } {
  if (score >= 100000) return { text: "Crítico", cls: "bg-red-100 text-red-800 border-red-200" };
  if (score >= 90000) return { text: "Urgente", cls: "bg-orange-100 text-orange-800 border-orange-200" };
  if (score >= 50000) return { text: "Em breve", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" };
  return { text: "Normal", cls: "bg-stone-100 text-stone-600 border-stone-200" };
}

export default function PriorityBadge({ score }: Props) {
  const { text, cls } = label(score);
  return (
    <span
      className={clsx(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border",
        cls
      )}
    >
      {text}
    </span>
  );
}
