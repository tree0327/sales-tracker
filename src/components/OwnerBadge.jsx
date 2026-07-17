// 소유자 표시. 예전에는 색(핑크/블루/앰버)으로 구분했지만,
// 색만으로 의미를 전달하지 않도록 텍스트 뱃지로 바꿨다(DESIGN.md §8).
const LABEL = { wife: '아내', husband: '남편', joint: '공금' };

export default function OwnerBadge({ owner }) {
  const label = LABEL[owner];
  if (!label) return null;
  return <span className="owner-badge">{label}</span>;
}
