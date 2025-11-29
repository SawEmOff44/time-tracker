# Geofence Policies Testing Guide

## Quick Access URLs
- **Admin Locations**: http://localhost:3000/admin/locations
- **Worker Clock**: http://localhost:3000/clock
- **Admin Exceptions**: http://localhost:3000/admin/exceptions
- **Prisma Studio**: http://localhost:5556

---

## Test Scenarios

### Setup Phase

1. **Open Admin Locations** (http://localhost:3000/admin/locations)
   - Login if needed
   - Create or edit a test location

2. **Configure Test Location with WARN Policy**
   ```
   Name: Test Site WARN
   Code: TEST-WARN
   Geofence Radius: 50 meters
   Grace Period: 20 seconds
   Policy: WARN
   Lat/Lng: Set to a known location (e.g., 40.7128, -74.0060 for NYC)
   ```

3. **Configure Test Location with STRICT Policy**
   ```
   Name: Test Site STRICT
   Code: TEST-STRICT
   Geofence Radius: 50 meters
   Grace Period: 20 seconds
   Policy: STRICT
   Lat/Lng: Same as above for comparison
   ```

---

### Test 1: Proximity Feedback UI ✅

**Goal**: Verify worker sees real-time distance feedback

1. Open worker clock page: http://localhost:3000/clock
2. Select "Test Site WARN" from dropdown
3. **Expected**: Should see proximity indicator showing:
   - Green checkmark if within 70m (50m + 20m tolerance)
   - Amber warning if outside but WARN policy
   - Red X if outside and STRICT policy
4. **Verify**: Distance calculation updates based on GPS
5. **Test**: Change to "Test Site STRICT" and verify color changes if outside radius

---

### Test 2: STRICT Policy - Clock-In Rejection ❌

**Goal**: Verify STRICT policy blocks clock-ins outside geofence

1. Use location selector to pick "Test Site STRICT"
2. Ensure your GPS is >70m away (or temporarily change location coords in Prisma Studio)
3. Enter valid employee code and PIN
4. Click "Clock In"
5. **Expected**: 
   - Error message: "You are Xm from Test Site STRICT. You must be within 70m to clock in..."
   - No shift created
   - Status remains "Clocked out"

---

### Test 3: WARN Policy - Clock-In with Flag ⚠️

**Goal**: Verify WARN policy allows clock-in but flags for review

1. Use location selector to pick "Test Site WARN"
2. Ensure your GPS is >70m away (same as Test 2)
3. Enter valid employee code and PIN
4. Click "Clock In"
5. **Expected**: 
   - Success message with warning: "⚠️ Clocked in at Test Site WARN. You are Xm from the site center. This shift is flagged for review."
   - Status changes to "Clocked in"
   - Timer starts running

6. **Verify in Admin**:
   - Go to http://localhost:3000/admin/exceptions (or shifts page)
   - Find the shift you just created
   - **Expected**: Shift notes contain "⚠️ Clock-in outside geofence (Xm from site, allowed 70m). Flagged for admin review."

---

### Test 4: Clock-Out with WARN Policy ⚠️

**Goal**: Verify clock-out also respects geofence policies

1. While still clocked in from Test 3
2. Move further away or stay outside geofence
3. Click "Clock Out"
4. **Expected with WARN policy**:
   - Success with warning: "⚠️ Clocked out from Test Site WARN. You are Xm from the site center. This shift is flagged for review."
   - Status changes to "Clocked out"
   - Shift notes appended with clock-out warning

5. **Verify in Admin**:
   - Check shift notes - should contain both clock-in and clock-out warnings
   - Example: 
     ```
     ⚠️ Clock-in outside geofence (125m from site, allowed 70m). Flagged for admin review.
     ⚠️ Clock-out outside geofence (130m from site, allowed 150m). Flagged for admin review.
     ```

---

### Test 5: Within Geofence - Normal Operation ✅

**Goal**: Verify normal operation when within geofence

1. Edit "Test Site STRICT" in Prisma Studio
2. Set lat/lng to match your current GPS location (or use mock coords nearby)
3. Go to clock page, select "Test Site STRICT"
4. **Expected Proximity UI**: Green checkmark "✓ You are 5m from this site. Within allowed range."
5. Clock in
6. **Expected**: 
   - Success: "Clocked in at Test Site STRICT. Clock-in recorded."
   - No warning flags
   - Shift notes are null or contain no ⚠️
7. Clock out
8. **Expected**: Normal clock-out, no flags

---

### Test 6: ADHOC Override 🔓

**Goal**: Verify ADHOC selection bypasses all GPS checks

1. Select "Other (ADHOC / off-site)" from dropdown
2. **Expected**: No proximity feedback shown (ADHOC has no geofence)
3. Clock in with any GPS location (or no GPS)
4. **Expected**: 
   - Success: "Clocked in (ADHOC). This shift may be reviewed by admin."
   - Shift created with notes: "ADHOC clock-in from clock page (Other selected)."
5. Clock out
6. **Expected**: Normal clock-out, ADHOC shifts don't enforce GPS on clock-out either

---

### Test 7: Admin Review Workflow 📊

**Goal**: Verify admins can see and manage flagged shifts

1. After completing Tests 3 & 4 (WARN policy with flags)
2. Go to http://localhost:3000/admin/exceptions
3. **Expected**: Flagged shifts should appear (may need to add filter/sort for notes containing "⚠️")
4. Alternatively, check Shifts page or Analytics
5. **Verify**: 
   - Admin can see which shifts were outside geofence
   - Distance information is logged
   - Policy mode is clear from notes

---

### Test 8: Edge Cases 🔍

**8a. Zero Radius (No GPS Required)**
- Set `geofenceRadiusMeters = 0` for a location
- Should skip all GPS validation (like old ADHOC behavior)

**8b. Legacy Locations (No Policy Set)**
- Locations without geofence fields should default to `radiusMeters` and STRICT policy
- Verify backwards compatibility

**8c. GPS Denied**
- Disable location services in browser
- Try to clock in at non-ADHOC site
- **Expected**: Error "GPS is required to clock in at this job site"

**8d. Invalid Coordinates**
- Test with lat > 90 or lng > 180
- Should detect and reject with error

---

## Success Criteria ✅

- [ ] Proximity feedback UI shows accurate distances
- [ ] STRICT policy blocks clock-ins outside geofence
- [ ] WARN policy allows but flags clock-ins outside geofence
- [ ] WARN policy allows but flags clock-outs outside geofence
- [ ] Within-geofence operations work normally (no flags)
- [ ] ADHOC bypasses all GPS validation
- [ ] Flagged shifts are visible in admin with clear notes
- [ ] Edge cases handled gracefully
- [ ] No compilation errors
- [ ] Dev server runs without crashes

---

## Cleanup

After testing:
1. Delete test locations if desired
2. Delete test shifts from database via Prisma Studio
3. Close Prisma Studio terminal (Ctrl+C)

---

## Notes

- **Distance Calculation**: Uses Haversine formula (accurate for small distances)
- **Tolerance**: Base tolerance is 20m for GPS noise, plus location-specific grace period
- **Color Coding**:
  - 🟢 Green: Within geofence
  - 🟡 Amber: Outside but WARN policy allows it
  - 🔴 Red: Outside and STRICT policy blocks it
- **Flagging**: Look for "⚠️" emoji in shift notes to identify flagged shifts

---

## Troubleshooting

**Issue**: Proximity not showing
- Ensure location has lat/lng set in database
- Check browser console for GPS errors
- Verify location includes geofenceRadiusMeters or radiusMeters > 0

**Issue**: All clock-ins rejected
- Check if policy is STRICT and you're outside radius
- Try WARN policy or ADHOC to test
- Verify GPS permissions enabled

**Issue**: Flags not appearing in admin
- Check shift.notes field in Prisma Studio
- Look for "⚠️ Clock-in outside geofence" text
- May need to add filter/search for flagged shifts in Exceptions page
