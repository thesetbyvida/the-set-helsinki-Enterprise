import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AppRole = "super_admin" | "admin" | "manager" | "employee";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appUrl = (Deno.env.get("APP_URL") || "").replace(/\/$/, "");
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) throw new Error("Missing authorization token");

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) throw new Error("Unauthorized");

    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles").select("role,is_active").eq("id", userData.user.id).single();
    if (profileError || !callerProfile?.is_active) throw new Error("Unauthorized");
    if (!["super_admin", "admin"].includes(callerProfile.role)) throw new Error("Admin access required");

    const body = await req.json();
    const action = String(body.action || "");

    if (action === "invite_employee") {
      const employeeId = String(body.employee_id || "");
      const email = String(body.email || "").trim().toLowerCase();
      const fullName = String(body.full_name || "").trim();
      const restaurantIds = Array.isArray(body.restaurant_ids) ? body.restaurant_ids.map(String) : [];
      if (!employeeId || !email || !fullName) throw new Error("Employee, name and email are required");

      const { data: employee, error: employeeError } = await adminClient
        .from("employees").select("id,email,auth_user_id").eq("id", employeeId).single();
      if (employeeError || !employee) throw employeeError || new Error("Employee not found");
      if (employee.email && String(employee.email).trim().toLowerCase() !== email) throw new Error("Employee email mismatch");

      let userId = employee.auth_user_id as string | null;
      let invited = false;

      if (!userId) {
        // First try a real invitation. If Auth reports that the address already exists,
        // locate that existing account and link it instead of creating a duplicate.
        const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
          data: { full_name: fullName, role: "employee", employee_id: employeeId },
          ...(appUrl ? { redirectTo: appUrl } : {}),
        });
        if (!inviteError && inviteData.user) {
          userId = inviteData.user.id;
          invited = true;
        } else {
          const { data: usersData, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
          if (listError) throw listError;
          const existing = usersData.users.find((u) => (u.email || "").toLowerCase() === email);
          if (!existing) throw inviteError || new Error("Unable to invite employee");
          userId = existing.id;
        }
      }

      const { error: profileUpsertError } = await adminClient.from("profiles").upsert({
        id: userId,
        email,
        full_name: fullName,
        role: "employee",
        is_active: true,
      });
      if (profileUpsertError) throw profileUpsertError;

      const { error: linkError } = await adminClient.from("employees")
        .update({ auth_user_id: userId, email, updated_at: new Date().toISOString() })
        .eq("id", employeeId);
      if (linkError) throw linkError;

      const { error: deleteRestaurantsError } = await adminClient.from("user_restaurants").delete().eq("user_id", userId);
      if (deleteRestaurantsError) throw deleteRestaurantsError;
      if (restaurantIds.length) {
        const { error: restaurantsError } = await adminClient.from("user_restaurants").insert(
          restaurantIds.map((restaurant_id: string) => ({ user_id: userId, restaurant_id }))
        );
        if (restaurantsError) throw restaurantsError;
      }

      return Response.json({ ok: true, user_id: userId, invited }, { headers: corsHeaders });
    }

    if (action === "create_user") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const fullName = String(body.full_name || "").trim();
      const role = (body.role || "employee") as AppRole;
      const restaurantIds = Array.isArray(body.restaurant_ids) ? body.restaurant_ids : [];
      if (!email || !fullName || password.length < 8) throw new Error("Name, email and password (8+ characters) are required");
      if (!["super_admin", "admin", "manager", "employee"].includes(role)) throw new Error("Invalid role");
      if (callerProfile.role !== "super_admin" && role === "super_admin") throw new Error("Only Super Admin can create another Super Admin");
      const { data: created, error: createError } = await adminClient.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: fullName } });
      if (createError || !created.user) throw createError || new Error("Unable to create user");
      const userId = created.user.id;
      try {
        const { error: upsertError } = await adminClient.from("profiles").upsert({ id: userId, email, full_name: fullName, role, is_active: true });
        if (upsertError) throw upsertError;
        if (restaurantIds.length) {
          const { error: restaurantsError } = await adminClient.from("user_restaurants").insert(restaurantIds.map((restaurant_id: string) => ({ user_id: userId, restaurant_id })));
          if (restaurantsError) throw restaurantsError;
        }
      } catch (setupError) {
        await adminClient.auth.admin.deleteUser(userId);
        throw setupError;
      }
      return Response.json({ ok: true, user_id: userId }, { headers: corsHeaders });
    }

    if (action === "update_password") {
      const userId = String(body.user_id || "");
      const password = String(body.password || "");
      if (!userId || password.length < 8) throw new Error("A user and password of 8+ characters are required");
      const { data: targetProfile, error: targetError } = await adminClient.from("profiles").select("role").eq("id", userId).single();
      if (targetError) throw targetError;
      if (callerProfile.role !== "super_admin" && targetProfile?.role === "super_admin") throw new Error("Only Super Admin can change a Super Admin password");
      const { error: passwordError } = await adminClient.auth.admin.updateUserById(userId, { password });
      if (passwordError) throw passwordError;
      return Response.json({ ok: true }, { headers: corsHeaders });
    }

    throw new Error("Unsupported action");
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400, headers: corsHeaders });
  }
});
