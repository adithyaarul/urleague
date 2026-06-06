function addGalleryPhotos(event) {
  const files = Array.from(event.target.files);
  files.forEach(f => {
    const reader = new FileReader();
    reader.onload = e => {
      S.gallery.push({ data: e.target.result, date: new Date().toLocaleDateString(), name: f.name });
      save();
      renderGallery();
    };
    reader.readAsDataURL(f);
  });
  event.target.value = '';
  toast(`${files.length} photo(s) added!`);
}

function renderGallery() {
  const el = document.getElementById('gallery-grid');
  if (!S.gallery.length) { el.innerHTML = '<div class="gallery-empty">No photos yet.</div>'; return; }
  el.innerHTML = S.gallery.map((img, i) =>
    `<div style="position:relative;">
      <img class="gallery-img" src="${img.data}" alt="${esc(img.name)}" onclick="viewGalleryImg(${i})"/>
      <button onclick="deleteGalleryImg(${i})" style="position:absolute;top:3px;right:3px;background:rgba(220,38,38,.8);color:#fff;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer;display:grid;place-items:center;">×</button>
    </div>`
  ).join('');
}

function deleteGalleryImg(i) {
  if (!confirm('Delete photo?')) return;
  S.gallery.splice(i, 1);
  save();
  renderGallery();
}

function viewGalleryImg(i) {
  const w = window.open('');
  w.document.write(`<!DOCTYPE html><html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${S.gallery[i].data}" style="max-width:100%;max-height:100vh;object-fit:contain;"/>
<!-- ═══ ROOM SETUP MODAL ═══ -->
<div class="room-setup-modal-overlay" id="room-setup-modal-overlay" onclick="if(event.target===this)closeRoomSetupModal()">
  <div class="room-setup-modal" style="max-height:92vh;overflow-y:auto;">
    <!-- Header -->
    <div class="room-setup-modal-header">
      <div style="display:flex;align-items:center;gap:12px;flex:1;">
        <div class="room-setup-modal-icon"><i class="ti ti-database"></i></div>
        <div>
          <div style="font-family:'Barlow Condensed',sans-serif;font-size:18px;font-weight:900;">Room Setup</div>
          <div style="font-size:11px;color:var(--text3);margin-top:1px;">One-time setup · Takes ~5 minutes · Free</div>
        </div>
      </div>
      <div class="room-setup-modal-close" onclick="closeRoomSetupModal()"><i class="ti ti-x"></i></div>
    </div>

    <div class="room-setup-modal-body">

      <!-- Steps -->
      <div style="display:flex;flex-direction:column;gap:10px;">

        <!-- Step 1 -->
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="width:24px;height:24px;border-radius:50%;background:var(--sport-primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;flex-shrink:0;">1</div>
            <div style="font-size:13px;font-weight:800;">Create a free Supabase project</div>
          </div>
          <div style="font-size:11px;color:var(--text3);line-height:1.6;padding-left:34px;">
            Go to <a href="https://supabase.com" target="_blank" style="color:var(--sport-primary);font-weight:700;">supabase.com</a> → Sign up free → New Project → choose any name and region → wait ~2 min for it to start.
          </div>
        </div>

        <!-- Step 2 -->
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="width:24px;height:24px;border-radius:50%;background:var(--sport-primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;flex-shrink:0;">2</div>
            <div style="font-size:13px;font-weight:800;">Enable Anonymous Sign-ins <span style="background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:1px 6px;font-size:9px;font-weight:800;margin-left:4px;">REQUIRED</span></div>
          </div>
          <div style="font-size:11px;color:var(--text3);line-height:1.6;padding-left:34px;">
            In your Supabase dashboard: <b style="color:var(--text2);">Authentication</b> → <b style="color:var(--text2);">Providers</b> → scroll to <b style="color:var(--text2);">Anonymous</b> → toggle it <b style="color:#10b981;">ON</b> → Save.<br>
            <span style="color:#ef4444;">⚠ This is why "Sign-in failed" appears — without this step rooms won't work.</span>
          </div>
        </div>

        <!-- Step 3 -->
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="width:24px;height:24px;border-radius:50%;background:var(--sport-primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;flex-shrink:0;">3</div>
            <div style="font-size:13px;font-weight:800;">Run the database setup SQL</div>
          </div>
          <div style="font-size:11px;color:var(--text3);line-height:1.6;padding-left:34px;margin-bottom:8px;">
            In Supabase: <b style="color:var(--text2);">SQL Editor</b> → <b style="color:var(--text2);">New query</b> → paste the SQL below → click <b style="color:var(--text2);">Run</b>.
          </div>
          <div style="padding-left:34px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
              <span style="font-size:9px;font-weight:800;text-transform:uppercase;color:var(--text3);">SQL</span>
              <button onclick="copySQLSetup()" style="background:var(--surface-1);border:1px solid var(--border);border-radius:8px;padding:3px 10px;font-size:10px;font-weight:700;color:var(--text2);cursor:pointer;display:flex;align-items:center;gap:4px;"><i class="ti ti-copy"></i> Copy All</button>
            </div>
            <div class="room-setup-sql" id="room-setup-sql-block">CREATE TABLE profiles (id UUID PRIMARY KEY REFERENCES auth.users(id), display_name TEXT, created_at TIMESTAMPTZ DEFAULT now());
CREATE TABLE rooms (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT UNIQUE NOT NULL, host_id UUID REFERENCES profiles(id), sport TEXT, match_name TEXT, state TEXT DEFAULT 'waiting', scoring_locked BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ);
CREATE TABLE room_members (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID REFERENCES rooms(id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id), role TEXT DEFAULT 'viewer', joined_at TIMESTAMPTZ DEFAULT now(), UNIQUE(room_id,user_id));
CREATE TABLE match_state (room_id UUID PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE, sport TEXT, state_data JSONB DEFAULT '{}', version BIGINT DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT now(), updated_by UUID REFERENCES profiles(id));
CREATE TABLE audit_log (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), room_id UUID REFERENCES rooms(id) ON DELETE CASCADE, user_id UUID REFERENCES profiles(id), action TEXT, old_value JSONB, new_value JSONB, created_at TIMESTAMPTZ DEFAULT now());
-- Helper function (SECURITY DEFINER bypasses RLS to prevent infinite recursion)
CREATE OR REPLACE FUNCTION is_room_member(p_room_id UUID, p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM room_members WHERE room_id = p_room_id AND user_id = p_user_id);
$$;
CREATE OR REPLACE FUNCTION is_room_member_role(p_room_id UUID, p_user_id UUID, p_roles TEXT[])
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM room_members WHERE room_id = p_room_id AND user_id = p_user_id AND role = ANY(p_roles));
$$;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rooms_select" ON rooms FOR SELECT USING (is_room_member(id, auth.uid()));
CREATE POLICY "rooms_insert" ON rooms FOR INSERT WITH CHECK (host_id = auth.uid());
CREATE POLICY "rooms_update" ON rooms FOR UPDATE USING (host_id = auth.uid());
CREATE POLICY "members_select" ON room_members FOR SELECT USING (user_id = auth.uid() OR is_room_member(room_id, auth.uid()));
CREATE POLICY "members_insert" ON room_members FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "state_insert" ON match_state FOR INSERT WITH CHECK (is_room_member_role(room_id, auth.uid(), ARRAY['host']));
CREATE POLICY "state_update" ON match_state FOR UPDATE USING (is_room_member_role(room_id, auth.uid(), ARRAY['host','scorer']));
CREATE POLICY "state_select" ON match_state FOR SELECT USING (is_room_member(room_id, auth.uid()));
CREATE POLICY "audit_insert" ON audit_log FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "audit_select" ON audit_log FOR SELECT USING (is_room_member(room_id, auth.uid()));
ALTER PUBLICATION supabase_realtime ADD TABLE rooms, match_state, room_members;</div>
          </div>
        </div>

        <!-- Step 4 -->
        <div style="background:var(--surface-2);border:1px solid var(--border);border-radius:14px;padding:14px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
            <div style="width:24px;height:24px;border-radius:50%;background:var(--sport-primary);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;color:#fff;flex-shrink:0;">4</div>
            <div style="font-size:13px;font-weight:800;">Paste your project credentials</div>
          </div>
          <div style="font-size:11px;color:var(--text3);line-height:1.6;padding-left:34px;margin-bottom:10px;">
            In Supabase: <b style="color:var(--text2);">Project Settings</b> → <b style="color:var(--text2);">API</b> → copy <b style="color:var(--text2);">Project URL</b> and <b style="color:var(--text2);">anon public</b> key.
          </div>
          <div style="padding-left:34px;display:flex;flex-direction:column;gap:8px;">
            <div>
              <label style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);display:block;margin-bottom:4px;">Project URL</label>
              <input id="modal-sb-url" class="input" placeholder="https://xxxx.supabase.co" style="font-size:13px;" />
            </div>
            <div>
              <label style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--text3);display:block;margin-bottom:4px;">Anon Public Key</label>
              <input id="modal-sb-key" class="input" placeholder="eyJhbGciOiJIUzI1…" type="password" style="font-size:13px;" />
            </div>
            <button class="btn primary full" onclick="saveRoomSetupModal()" style="padding:13px;font-size:14px;font-weight:800;margin-top:2px;">
              <i class="ti ti-check"></i> Save &amp; Connect
            </button>
          </div>
        </div>

        <!-- Done note -->
        <div style="background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.25);border-radius:12px;padding:12px 14px;font-size:11px;color:var(--text2);line-height:1.6;">
          <b style="color:#10b981;"><i class="ti ti-circle-check"></i> After setup:</b> Tap any sport → "Create a Room" → enter your name → your room code appears instantly. Share it with friends to score together live.
        </div>

      </div>
    </div>
  </div>
</div>

</body></html>`);
}



// ═══════════════════════════════════════════════════════
// PLAYER LIBRARY
// ═══════════════════════════════════════════════════════

let _rosterSort = 'name';
let _libraryPhoto = null;
