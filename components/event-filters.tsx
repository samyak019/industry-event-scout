import Link from "next/link";

type Opt = { value: string; label: string };

function Select({ name, label, value, options }: { name: string; label: string; value: string; options: Opt[] }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="mono-tag text-white/40">{label}</span>
      <select name={name} defaultValue={value} className="field px-3 py-2 text-sm">
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Plain GET form so filters work without client JavaScript and are shareable as URLs. */
export function EventFilters({ current, cities, domains, sources }: { current: Record<string, string>; cities: string[]; domains: string[]; sources: string[] }) {
  return (
    <form method="get" className="glass grid grid-cols-2 gap-3 rounded-[2rem] p-4 sm:grid-cols-3 lg:grid-cols-6" aria-label="Filter events">
      <input type="hidden" name="view" value={current.view ?? ""} />
      <Select name="city" label="City" value={current.city ?? ""} options={[...cities.map((c) => ({ value: c, label: c })), { value: "online", label: "Online" }]} />
      <Select name="domain" label="Domain" value={current.domain ?? ""} options={domains.map((d) => ({ value: d, label: d }))} />
      <Select
        name="urgency"
        label="Deadline"
        value={current.urgency ?? ""}
        options={[
          { value: "urgent", label: "Closing < 7 days" },
          { value: "open", label: "Known, ≥ 7 days" },
          { value: "unknown", label: "Not listed" },
        ]}
      />
      <Select name="source" label="Source" value={current.source ?? ""} options={sources.map((s) => ({ value: s, label: s }))} />
      <div className="col-span-2 flex items-end gap-2 sm:col-span-1 lg:col-span-2">
        <button className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition-transform hover:scale-105">Apply</button>
        <Link href={current.view ? `/?view=${current.view}` : "/"} className="rounded-full px-4 py-2 text-sm text-white/60 hover:text-white">
          Reset
        </Link>
      </div>
    </form>
  );
}
