-- 카드 수수료율 13.3% → 10% 되돌리기.
-- 기존 카드 기록의 final(최종액)을 10% 차감 = floor(원금 × 0.9) 으로 재계산한다.
-- (13.3% 시절 floor(original*0.867) 로 저장된 값을 원복. 이미 10%면 멱등이라 안전.)
update public.sales_records
set final = floor(original * 0.9)
where type = '카드';
