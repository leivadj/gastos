"use client";

const EMOJIS = [
  "🏠", "💡", "💧", "🔥", "🛒", "📺", "📱", "🌐", "🚗", "⛽",
  "🍔", "🍕", "☕", "🎬", "🎮", "✈️", "🏥", "💊", "🎓", "🐶",
  "👕", "🎁", "💳", "🏦", "💰", "📦", "🧾", "🎉", "🛠️", "📶",
];

export function IconoPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange("")}
          className={`flex h-9 w-9 items-center justify-center rounded-lg border text-xs text-gray-400 ${
            value === "" ? "border-brand-from bg-purple-50" : "border-gray-200"
          }`}
        >
          —
        </button>
        {EMOJIS.map((emoji) => (
          <button
            type="button"
            key={emoji}
            onClick={() => onChange(emoji === value ? "" : emoji)}
            className={`flex h-9 w-9 items-center justify-center rounded-lg border text-lg ${
              value === emoji ? "border-brand-from bg-purple-50" : "border-gray-200"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 4))}
        placeholder="O escribe/pega otro emoji"
        className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
    </div>
  );
}
