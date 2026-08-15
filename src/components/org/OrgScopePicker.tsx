import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function OrgScopePicker({ groups, value, onChange, allowOrg = true, orgLabel = "組織全体" }:
  { groups: any[]; value: string; onChange: (v: string) => void; allowOrg?: boolean; orgLabel?: string }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-48 h-9"><SelectValue placeholder="範囲" /></SelectTrigger>
      <SelectContent>
        {allowOrg && <SelectItem value="org">{orgLabel}</SelectItem>}
        {groups.map((g) => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
