param(
    [Parameter(Mandatory = $true)][long]$WidgetHwnd,
    [ValidateSet('start', 'center', 'end')][string]$Position = 'start',
    [ValidateRange(24, 1000)][int]$Width = 120,
    [ValidateRange(20, 200)][int]$Height = 36,
    [ValidateRange(-240, 240)][int]$Offset = 0
)

$nativeSource = @'
using System;
using System.Runtime.InteropServices;

public static class TaskbarNative
{
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr FindWindow(string className, string windowName);

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr childAfter, string className, string windowName);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool GetWindowRect(IntPtr window, out RECT rect);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int GetWindowLong(IntPtr window, int index);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern int SetWindowLong(IntPtr window, int index, int value);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr SetParent(IntPtr child, IntPtr parent);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern IntPtr GetParent(IntPtr child);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool SetWindowPos(IntPtr window, IntPtr insertAfter, int x, int y, int width, int height, uint flags);
}
'@

Add-Type -TypeDefinition $nativeSource -ErrorAction Stop

$widget = [IntPtr]::new($WidgetHwnd)
$taskbar = [TaskbarNative]::FindWindow('Shell_TrayWnd', $null)
if ($taskbar -eq [IntPtr]::Zero) { throw 'Windows taskbar was not found.' }

$taskbarRect = [TaskbarNative+RECT]::new()
if (-not [TaskbarNative]::GetWindowRect($taskbar, [ref]$taskbarRect)) { throw 'Could not read the taskbar bounds.' }

$parentChanged = [TaskbarNative]::GetParent($widget) -ne $taskbar
if ($parentChanged) {
    $GWL_STYLE = -16
    $WS_POPUP = -2147483648
    $WS_CHILD = 0x40000000
    $style = [TaskbarNative]::GetWindowLong($widget, $GWL_STYLE)
    $style = ($style -band (-bnot $WS_POPUP)) -bor $WS_CHILD
    [void][TaskbarNative]::SetWindowLong($widget, $GWL_STYLE, $style)
    [void][TaskbarNative]::SetParent($widget, $taskbar)
}

$taskbarWidth = $taskbarRect.Right - $taskbarRect.Left
$taskbarHeight = $taskbarRect.Bottom - $taskbarRect.Top
$isVertical = $taskbarHeight -gt $taskbarWidth
$adjusted = $false
$placementNote = $null

if ($isVertical) {
    $x = [Math]::Max(0, [Math]::Floor(($taskbarWidth - $Width) / 2))
    switch ($Position) {
        'start'  {
            $y = 60 + $Offset
            $adjusted = $true
            $placementNote = 'Placed beside Windows controls'
        }
        'center' { $y = [Math]::Floor(($taskbarHeight - $Height) / 2) + $Offset }
        'end'    { $y = $taskbarHeight - $Height - 20 + $Offset }
    }
} else {
    $y = [Math]::Max(0, [Math]::Floor(($taskbarHeight - $Height) / 2))
    switch ($Position) {
        'start'  {
            # Leave the Windows/Start button lane intact rather than painting over it.
            $x = 60 + $Offset
            $adjusted = $true
            $placementNote = 'Placed beside Windows controls'
        }
        'center' { $x = [Math]::Floor(($taskbarWidth - $Width) / 2) + $Offset }
        'end' {
            $tray = [TaskbarNative]::FindWindowEx($taskbar, [IntPtr]::Zero, 'TrayNotifyWnd', $null)
            if ($tray -ne [IntPtr]::Zero) {
                $trayRect = [TaskbarNative+RECT]::new()
                [void][TaskbarNative]::GetWindowRect($tray, [ref]$trayRect)
                $x = $trayRect.Left - $taskbarRect.Left - $Width - 6 + $Offset
            } else {
                $x = $taskbarWidth - $Width - 20 + $Offset
            }
        }
    }
}

$unclampedX = $x
$unclampedY = $y
$x = [Math]::Max(0, [Math]::Min($x, $taskbarWidth - $Width))
$y = [Math]::Max(0, [Math]::Min($y, $taskbarHeight - $Height))
if ($x -ne $unclampedX -or $y -ne $unclampedY) {
    $adjusted = $true
    $placementNote = 'Adjusted to remain inside the taskbar'
}

$widgetRect = [TaskbarNative+RECT]::new()
$hasWidgetRect = [TaskbarNative]::GetWindowRect($widget, [ref]$widgetRect)
$targetScreenX = $taskbarRect.Left + $x
$targetScreenY = $taskbarRect.Top + $y
$boundsChanged = -not $hasWidgetRect -or
    $widgetRect.Left -ne $targetScreenX -or
    $widgetRect.Top -ne $targetScreenY -or
    ($widgetRect.Right - $widgetRect.Left) -ne $Width -or
    ($widgetRect.Bottom - $widgetRect.Top) -ne $Height
$SWP_NOACTIVATE = 0x0010
$SWP_SHOWWINDOW = 0x0040
$SWP_ASYNCWINDOWPOS = 0x4000
if ($parentChanged -or $boundsChanged) {
    if (-not [TaskbarNative]::SetWindowPos($widget, [IntPtr]::Zero, $x, $y, $Width, $Height, $SWP_NOACTIVATE -bor $SWP_SHOWWINDOW -bor $SWP_ASYNCWINDOWPOS)) {
        throw 'Could not attach the widget to the taskbar.'
    }
}

[pscustomobject]@{
    ok = $true
    x = $x
    y = $y
    width = $Width
    height = $Height
    vertical = $isVertical
    changed = ($parentChanged -or $boundsChanged)
    adjusted = $adjusted
    note = $placementNote
} | ConvertTo-Json -Compress
