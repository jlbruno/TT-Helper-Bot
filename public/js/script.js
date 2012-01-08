console.log('script loaded');

$('#commands').on('click', 'a', function(e) {
	e.preventDefault();
	var command = $(this).attr('data-command');
	
	$.ajax({
		url: '/' + command + '/',
		success: function(){
			$(this).addClass("done");
		}
	});
});
