import { Icon } from "@/components/shell/Icon";
import { Timer } from "./Timer";

export function LockdownBar({
  title,
  studentName,
  pcHostname,
  attemptNumber,
  expiresAt,
  onExpire,
}: {
  title: string;
  studentName: string;
  pcHostname: string | null;
  attemptNumber: number;
  expiresAt: string;
  onExpire: () => void;
}) {
  return (
    <div className="lockbar">
      <div className="lb-left">
        <div className="lb-lock">
          <span className="dot" />
          <Icon name="lock" size={14} />
          Exam mode · PC locked
        </div>
        <div>
          <div className="lb-title">{title}</div>
          <div className="lb-sub">
            {studentName.toUpperCase()} · {(pcHostname ?? "UNKNOWN PC").toUpperCase()} · ATTEMPT {attemptNumber}
          </div>
        </div>
      </div>
      <Timer expiresAt={expiresAt} onExpire={onExpire} />
    </div>
  );
}
