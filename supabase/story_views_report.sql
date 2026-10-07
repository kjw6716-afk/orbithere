-- Owner-only aggregate SELECT for the morning briefing. No role switch, RPC,
-- account/session lookup, or recent_views token read. Today is incomplete.
with bounds as (
  select (now() at time zone 'Asia/Seoul')::date as today
), counts as (
  select d.story_id,
    coalesce(sum(d.views) filter (where d.day = b.today - 1), 0)::bigint as yesterday_views,
    coalesce(sum(d.views) filter (where d.day = b.today - 2), 0)::bigint as previous_day_views,
    coalesce(sum(d.views) filter (where d.day >= b.today - 7), 0)::bigint as last_7d_views,
    coalesce(sum(d.views) filter (where d.day >= b.today - 14 and d.day < b.today - 7), 0)::bigint as previous_7d_views,
    sum(d.views)::bigint as cumulative_views
  from orbit_story_private.daily d cross join bounds b
  where d.day < b.today
  group by d.story_id
)
select c.story_id, c.published_on,
  c.tracking_started_at at time zone 'Asia/Seoul' as tracking_started_kst,
  b.today - 1 as report_day,
  coalesce(n.yesterday_views, 0) as yesterday_views,
  coalesce(n.previous_day_views, 0) as previous_day_views,
  coalesce(n.last_7d_views, 0) as last_7d_views,
  coalesce(n.previous_7d_views, 0) as previous_7d_views,
  coalesce(n.cumulative_views, 0) as cumulative_views,
  case when c.published_on >= b.today then 'not_published'
       when c.tracking_started_at >= (b.today::timestamp at time zone 'Asia/Seoul') then 'not_started'
       when c.tracking_started_at > ((b.today - 1)::timestamp at time zone 'Asia/Seoul') then 'partial'
       else 'tracked' end as yesterday_coverage,
  case when c.tracking_started_at >= (b.today::timestamp at time zone 'Asia/Seoul') then 'not_started'
       when c.tracking_started_at > ((b.today - 7)::timestamp at time zone 'Asia/Seoul') then 'partial'
       else 'tracked' end as last_7d_coverage,
  case when c.tracking_started_at >= ((b.today - 7)::timestamp at time zone 'Asia/Seoul') then 'not_started'
       when c.tracking_started_at > ((b.today - 14)::timestamp at time zone 'Asia/Seoul') then 'partial'
       else 'tracked' end as previous_7d_coverage
from orbit_story_private.catalogue c cross join bounds b
left join counts n using(story_id)
where c.published_on < b.today
order by last_7d_views desc, yesterday_views desc, cumulative_views desc, c.story_id;
