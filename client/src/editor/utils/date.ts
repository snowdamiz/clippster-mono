import { formatDate as fmtDate } from "@/utils/dateTimeUtils";

export function formatDate({ date }: { date: Date }): string {
	return fmtDate(date);
}
