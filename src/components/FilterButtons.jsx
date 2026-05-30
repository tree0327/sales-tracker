export default function FilterButtons({ activeFilter, onFilterChange }) {
  return (
    <div className="filter-buttons">
      {['전체', '현금', '카드'].map((f) => (
        <button
          key={f}
          className={`filter-btn ${activeFilter === f ? 'active' : ''} ${
            f === '현금' ? 'cash-filter' : f === '카드' ? 'card-filter' : ''
          }`}
          onClick={(e) => {
            e.stopPropagation();
            onFilterChange(f);
          }}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
