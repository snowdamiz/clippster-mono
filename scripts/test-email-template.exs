# Run the shared layout tests without starting Phoenix or PostgreSQL.
Code.require_file("../server/lib/clippster_server/email_template.ex", __DIR__)
ExUnit.start()
Code.require_file("../server/test/clippster_server/email_template_test.exs", __DIR__)
