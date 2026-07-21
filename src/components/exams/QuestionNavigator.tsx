export function QuestionNavigator({
  total,
  answeredIds,
  currentIndex,
  onJump,
  onFinish,
}: {
  total: number;
  answeredIds: Set<number>;
  currentIndex: number;
  onJump: (index: number) => void;
  onFinish: () => void;
}) {
  return (
    <div className="navcard">
      <div className="nav-title">Questions</div>
      <div className="qgrid">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            className={"qdot" + (answeredIds.has(i) ? " ans" : "") + (i === currentIndex ? " cur" : "")}
            onClick={() => onJump(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <div className="nav-stat">
        <span>Answered</span>
        <b>
          {answeredIds.size} / {total}
        </b>
      </div>
      <button className="btn leaf finish-btn" onClick={onFinish}>
        Finish exam
      </button>
    </div>
  );
}
