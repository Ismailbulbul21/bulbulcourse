-- Seed one published demo course so the catalog is not empty on first run.
do $$
declare
  v_course uuid;
  v_m1 uuid;
  v_m2 uuid;
begin
  insert into public.courses (title, description, category, price, status)
  values (
    'Web Development Foundations',
    'Learn HTML, CSS and JavaScript from zero. This is a demo course seeded by the initial migration — edit or delete it in the admin panel, then upload your own videos.',
    'Web Development',
    10.00,
    'published'
  )
  returning id into v_course;

  insert into public.modules (course_id, title, sort_order)
  values (v_course, 'Getting Started', 0)
  returning id into v_m1;

  insert into public.modules (course_id, title, sort_order)
  values (v_course, 'HTML Basics', 1)
  returning id into v_m2;

  insert into public.lessons (module_id, course_id, title, description, is_preview, sort_order) values
    (v_m1, v_course, 'Welcome to the course', 'What you will learn and how this course works.', true, 0),
    (v_m1, v_course, 'Setting up your tools', 'Install VS Code and a modern browser.', true, 1),
    (v_m2, v_course, 'Your first HTML page', 'Create index.html and understand tags.', false, 0),
    (v_m2, v_course, 'Text, links and images', 'The core HTML elements every page uses.', false, 1);
end $$;
