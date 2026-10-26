"""Pull the anatomy figure's numbers from the recalculated model. Usage: python3 tools/anatomy/model_figures.py path/to/recalc.xlsx"""
import sys,json,openpyxl
V=openpyxl.load_workbook(sys.argv[1],data_only=True)
fp,cn,rt,wa=V['Firm-Power'],V['Connectivity'],V['Rates'],V['Water']
cc={cn.cell(r,1).value:cn.cell(r,3).value for r in range(17,46)}
m={'facility_mw':fp['B5'].value,'net_nameplate_mw':fp['B6'].value,'avg_mw':fp['B7'].value,'producers_x_net':fp['B8'].value,
 'well_margin_mw':fp['B9'].value,'n1_mw':fp['B10'].value,'n1_it_mw':fp['B11'].value,'uncovered_h':fp['B13'].value,
 'per_well_net_mw':5,'producers':2,'injectors':2,'t_prod_c':215,'pue':1.25,'module_it_mw':1.25,'modules':4,'cf':0.9,
 'fibre_km_line':cc['km_moomba'],'fibre_route_factor':1.2,'bore_aud':rt['D91'].value,'stim_water_ml':rt['D92'].value,
 'makeup_1pct_ml':wa['D38'].value,'decline_threshold_c':V['Decline']['C28'].value,'decline_default_c':V['Decline']['C4'].value}
json.dump(m,open(__file__.replace('model_figures.py','model.json'),'w'),indent=1); print(m)
