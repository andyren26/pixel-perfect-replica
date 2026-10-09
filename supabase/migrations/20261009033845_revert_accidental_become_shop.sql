-- Two customers were flipped to 'shop' by an accidental click on the one-click
-- "Become a shop" header button. Neither owns a barber or has payout details.
update public.profiles p
   set role = 'customer'
 where p.email in ('valuetrack66@gmail.com', 't11216@mail.fhjh.tn.edu.tw')
   and p.role = 'shop'
   and not exists (select 1 from public.barbers b where b.shop_id = p.id);
