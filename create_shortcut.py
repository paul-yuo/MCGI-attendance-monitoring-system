"""
Creates the Desktop shortcut for MCGI Production Monitoring System.
Sets AppUserModelID on the .lnk so Windows can match the running process
to the shortcut and use app_icon.ico (not the browser favicon) for the taskbar.
"""
import os
import sys

APP_ID = 'MCGI.Production.Attendance.System.1.0'

def find_pythonw():
    candidates = [
        sys.executable.replace('python.exe', 'pythonw.exe'),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python314\pythonw.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python313\pythonw.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python312\pythonw.exe"),
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Python\Python311\pythonw.exe"),
        r"C:\Windows\pyw.exe",
        sys.executable,
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return sys.executable

def create_desktop_shortcut():
    desktop      = os.path.join(os.path.expanduser('~'), 'Desktop')
    project_dir  = os.path.dirname(os.path.abspath(__file__))
    pythonw_exe  = find_pythonw()
    launcher_py  = os.path.join(project_dir, 'app_launcher.py')
    icon_path    = os.path.join(project_dir, 'app_icon.ico')
    shortcut_path = os.path.join(desktop, 'MCGI Production Monitoring System.lnk')

    # Use Shell.Application COM object so we can set AppUserModelID on the shortcut.
    # The AppUserModelID must match what app_launcher.py sets at runtime so Windows
    # will merge the taskbar button and use the .ico instead of the browser favicon.
    ps_script = f"""
Add-Type -AssemblyName System.Runtime.InteropServices
$ws = New-Object -ComObject WScript.Shell
$s  = $ws.CreateShortcut('{shortcut_path}')
$s.TargetPath      = '{pythonw_exe}'
$s.Arguments       = '"{launcher_py}"'
$s.WorkingDirectory = '{project_dir}'
$s.Description     = 'MCGI Production Monitoring System'
$s.IconLocation    = '{icon_path},0'
$s.WindowStyle     = 1
$s.Save()

# Now set the AppUserModelID property on the .lnk via IPropertyStore (Windows Shell)
# This is what tells Windows to group the taskbar button under the shortcut's icon.
$shellLinkType = [Type]::GetTypeFromCLSID([Guid]'00021401-0000-0000-C000-000000000046')
$shellLink = [Activator]::CreateInstance($shellLinkType)

$persistFile = [System.Runtime.InteropServices.Marshal]::GetComInterfaceForObject($shellLink, [Type]::GetTypeFromProgID('Shell.Application').Assembly.GetType('IShellLinkW'))

# Simpler approach: re-open with Shell.Application and set via ShellLinkObject
$sa = New-Object -ComObject Shell.Application
$folder = $sa.NameSpace([System.IO.Path]::GetDirectoryName('{shortcut_path}'))
$item   = $folder.ParseName([System.IO.Path]::GetFileName('{shortcut_path}'))
"""

    # The PowerShell COM approach for AppUserModelID on a .lnk requires propvariant.
    # Use a simpler inline C# snippet instead.
    ps_script = f"""
$ws = New-Object -ComObject WScript.Shell
$s  = $ws.CreateShortcut('{shortcut_path}')
$s.TargetPath       = '{pythonw_exe}'
$s.Arguments        = '"{launcher_py}"'
$s.WorkingDirectory = '{project_dir}'
$s.Description      = 'MCGI Production Monitoring System'
$s.IconLocation     = '{icon_path},0'
$s.WindowStyle      = 1
$s.Save()
Write-Host "Shortcut saved."

# Set AppUserModelID on the shortcut so Windows groups the taskbar button
# under the shortcut icon (app_icon.ico) instead of the browser favicon.
$code = @"
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;

public class ShortcutAppId {{
    [DllImport("ole32.dll")]
    static extern int StgOpenStorageEx(string pwcsName, int grfMode, int stgfmt,
        int grfAttrs, IntPtr pStgOptions, IntPtr reserved2,
        [In] ref Guid riid, out IPropertyStore ppObjectOpen);

    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore {{
        int GetCount(out uint cProps);
        int GetAt(uint iProp, out PROPERTYKEY pkey);
        int GetValue([In] ref PROPERTYKEY key, out PropVariant pv);
        int SetValue([In] ref PROPERTYKEY key, [In] ref PropVariant pv);
        int Commit();
    }}

    [StructLayout(LayoutKind.Sequential)]
    public struct PROPERTYKEY {{
        public Guid fmtid;
        public uint pid;
    }}

    [StructLayout(LayoutKind.Explicit)]
    public struct PropVariant {{
        [FieldOffset(0)] public ushort vt;
        [FieldOffset(8)] public IntPtr ptr;
    }}

    public static void SetAppId(string lnkPath, string appId) {{
        IPropertyStore store;
        Guid IID_IPropertyStore = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
        int STGM_READWRITE = 2;
        int STGFMT_STORAGE = 0;
        StgOpenStorageEx(lnkPath, STGM_READWRITE, STGFMT_STORAGE,
            0, IntPtr.Zero, IntPtr.Zero, ref IID_IPropertyStore, out store);
        if (store == null) return;
        var key = new PROPERTYKEY {{
            fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"),
            pid   = 5
        }};
        IntPtr strPtr = Marshal.StringToCoTaskMemUni(appId);
        var pv = new PropVariant {{ vt = 31, ptr = strPtr }};
        store.SetValue(ref key, ref pv);
        store.Commit();
        Marshal.FreeCoTaskMem(strPtr);
        Marshal.ReleaseComObject(store);
    }}
}}
"@
Add-Type -TypeDefinition $code -Language CSharp
try {{
    [ShortcutAppId]::SetAppId('{shortcut_path}', '{APP_ID}')
    Write-Host "AppUserModelID set on shortcut: {APP_ID}"
}} catch {{
    Write-Host "Note: Could not set AppUserModelID on shortcut (non-critical): $_"
}}
"""

    ps_file = os.path.join(project_dir, '_make_shortcut.ps1')
    with open(ps_file, 'w', encoding='utf-8') as f:
        f.write(ps_script)

    os.system(f'powershell -NoProfile -ExecutionPolicy Bypass -File "{ps_file}"')

    if os.path.exists(ps_file):
        os.remove(ps_file)

    if os.path.exists(shortcut_path):
        print(f"SUCCESS: Desktop shortcut created:\n  {shortcut_path}")
        print(f"  Target : {pythonw_exe}")
        print(f"  AppID  : {APP_ID}")
    else:
        print("ERROR: Could not create shortcut.")

if __name__ == '__main__':
    create_desktop_shortcut()
